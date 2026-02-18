package com.declitech.session.repository;

import com.declitech.session.dto.SessionFilterRequest;
import com.declitech.session.model.Session;
import com.declitech.session.model.SessionStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public class SessionSpecification {

    public static Specification<Session> filterBy(SessionFilterRequest filter) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (filter.getTitle() != null && !filter.getTitle().trim().isEmpty()) {
                predicates.add(criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("title")),
                    "%" + filter.getTitle().toLowerCase().trim() + "%"
                ));
            }

            if (filter.getSessionCode() != null && !filter.getSessionCode().trim().isEmpty()) {
                predicates.add(criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("sessionCode")),
                    "%" + filter.getSessionCode().toLowerCase().trim() + "%"
                ));
            }

            if (filter.getStatus() != null && !filter.getStatus().trim().isEmpty()) {
                try {
                    SessionStatus status = SessionStatus.valueOf(filter.getStatus().toUpperCase());
                    predicates.add(criteriaBuilder.equal(root.get("status"), status));
                } catch (IllegalArgumentException e) {
                    // Invalid status value, ignore filter
                }
            }

            if (filter.getInstructorUsername() != null && !filter.getInstructorUsername().trim().isEmpty()) {
                predicates.add(criteriaBuilder.equal(
                    criteriaBuilder.lower(root.get("instructorUsername")),
                    filter.getInstructorUsername().toLowerCase().trim()
                ));
            }

            if (filter.getSearch() != null && !filter.getSearch().trim().isEmpty()) {
                String searchPattern = "%" + filter.getSearch().toLowerCase().trim() + "%";
                Predicate titleMatch = criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("title")), searchPattern);
                Predicate codeMatch = criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("sessionCode")), searchPattern);
                Predicate instructorMatch = criteriaBuilder.like(
                    criteriaBuilder.lower(root.get("instructorUsername")), searchPattern);

                predicates.add(criteriaBuilder.or(titleMatch, codeMatch, instructorMatch));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }
}
